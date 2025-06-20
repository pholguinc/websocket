import express, {Request, Response, NextFunction } from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import chalk from "chalk";
import cors from "cors";
import { getConnection } from "./conection.js";
import sql from "mssql";

const app = express();
app.use(express.json());
app.use(cors());

const options = {
  cors: {
    origin: "http://localhost:4200",
  },
};

const server = http.createServer(app);
const io = new Server(server, options);

const userSockets: { [key: number]: Socket } = {}; 

app.post("/notify", async (req, res) => {
  const { mensaje, fecha_creacion, leido, usuario_id, destinatario_id, id_solicitud_analisis } =
    req.body;

  console.log(
    `${chalk.blue("Notificación recibida via HTTP POST:")}`,
    req.body
  );

  try {
    const pool = await getConnection();

    const result = await pool
      .request()
      .input("mensaje", sql.NVarChar, mensaje)
      .input("fecha_creacion", sql.DateTime, new Date(fecha_creacion))
      .input("leido", sql.Bit, leido)
      .input("usuario_id", sql.BigInt, usuario_id)
      .input("destinatario_id", sql.BigInt, destinatario_id)
      .input("id_solicitud_analisis", sql.BigInt, id_solicitud_analisis).query(`
        INSERT INTO laboratorio.notificaciones (mensaje, fecha_creacion, leido, usuario_id, destinatario_id, id_solicitud_analisis)
        OUTPUT INSERTED.id
        VALUES (@mensaje, @fecha_creacion, @leido, @usuario_id, @destinatario_id, @id_solicitud_analisis)
      `);

    const insertedId = result.recordset[0].id;
    console.log("insertedId:", insertedId);

    const payload = { ...req.body, id: insertedId };

    const targetSocket = userSockets[destinatario_id]; 

    if (targetSocket) {
      targetSocket.emit("evento", payload); 
      console.log(`Notificación enviada a usuario ${destinatario_id}`);
    } else {
      console.log(`Usuario con ID ${destinatario_id} no está conectado`);
    }

    res
      .status(200)
      .json({ message: "Notificación registrada y enviada", id: insertedId });
  } catch (error) {
    console.error(
      chalk.red("Error al guardar notificación en SQL Server:"),
      error
    );
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.put("/notify/:id/read", (req: Request, res: Response, next: NextFunction) => {
  (async () => {
    const { id } = req.params;
  console.log(
    `${chalk.yellow("Marcando como leída la notificación con ID:")}`,
    id
  );

  try {
    const pool = await getConnection();

    const result = await pool.request().input("id", sql.BigInt, id).query(`
        UPDATE laboratorio.notificaciones
        SET leido = 1
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).send("Notificación no encontrada");
    }

    res.status(200).json({ message: "Notificación registrada y enviada" });
  } catch (error) {
    console.error(chalk.red("Error al actualizar notificación:"), error);
    res.status(500).json({ error: "Error en el servidor" });
  }

});
});

io.on("connection", (socket: any) => {
  const usuario_id = socket.handshake.query.usuario_id;

  if (usuario_id) {
    userSockets[usuario_id] = socket;
    console.log(`Usuario ${usuario_id} conectado con socket ${socket.id}`);
  }

  console.log("Usuarios conectados:", Object.keys(userSockets)); 

  socket.on("sendNotification", (payload:any) => {
    const targetSocket = userSockets[payload.destinatario_id]; 
    if (targetSocket) {
      targetSocket.emit("evento", payload);
      console.log(`Notificación enviada a usuario ${payload.destinatario_id}`);
    } else {
      console.log(
        `Usuario con ID ${payload.destinatario_id} no está conectado`
      );
    }
  });

  socket.on("disconnect", () => {
    if (usuario_id) {
      delete userSockets[usuario_id];
      console.log(`Usuario ${usuario_id} desconectado`);
    }
  });
});



// Iniciar el servidor en el puerto 5000
server.listen(5000, () => {
  console.log("\n");
  console.log(
    `>> Socket listo y escuchando por el puerto: ${chalk.green("5000")}`
  );
});
