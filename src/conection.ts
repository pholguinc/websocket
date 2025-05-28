import sql from "mssql";

const config: sql.config = {
  user: "",
  password: "",
  server: "",
  database: "",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};
let pool: sql.ConnectionPool | null = null;

export const getConnection = async (): Promise<sql.ConnectionPool> => {
  if (pool) return pool;

  try {
    pool = await sql.connect(config);
    console.log(">> Conexión establecida con SQL Server");
    return pool;
  } catch (err) {
    console.error("Error de conexión:", err);
    throw err;
  }
};
