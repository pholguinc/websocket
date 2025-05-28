import sql from "mssql";

const config: sql.config = {
  user: "sa",
  password: "holadiris2024@",
  server: "172.16.1.106",
  database: "laboratorio_dev",
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