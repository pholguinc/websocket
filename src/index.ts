import express from "express";
import http from "http";
import { Server } from "socket.io";
import chalk from "chalk";
import cors from "cors";
import { getConnection } from "./conection";
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

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/notify", async (req, res) => {
  const { mensaje, fecha_creacion, leido, usuario_id } = req.body;

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
      .input("usuario_id", sql.BigInt, usuario_id).query(`
        INSERT INTO laboratorio.notificaciones (mensaje, fecha_creacion, leido, usuario_id)
        OUTPUT INSERTED.id
        VALUES (@mensaje, @fecha_creacion, @leido, @usuario_id)
      `);

      const insertedId = result.recordset[0].id;

    console.log('insertedId:', insertedId); 
    const payload = { ...req.body, id: insertedId };

    io.emit("evento", payload);

    res.status(200).json({ message: "Notificación registrada y enviada", id: insertedId });
  } catch (error) {
    console.error(
      chalk.red("Error al guardar notificación en SQL Server:"),
      error
    );
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.put("/notify/:id/read", async (req, res) => {
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

io.on("connection", (socket) => {
  const nameRoom =
    typeof socket.handshake.query.nameRoom === "string"
      ? socket.handshake.query.nameRoom
      : "defaultRoom";

  console.log(
    `${chalk.green(
      `Nuevo dispositivo: ${socket.id}`
    )} conectado a la ${nameRoom}`
  );
  socket.join(nameRoom);

  socket.on("evento", (res) => {
    socket.to(nameRoom).emit("evento", res);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

server.listen(5000, () => {
  console.log("\n");
  console.log(
    `>> Socket listo y escuchando por el puerto: ${chalk.green("5000")}`
  );
});
