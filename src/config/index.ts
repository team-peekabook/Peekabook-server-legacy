import dotenv from "dotenv";
import path from "path";

// Set NODE_ENV to 'development' by default
process.env.NODE_ENV = process.env.NODE_ENV || "development";

// 동적으로 env 파일 경로 설정
const envFilePath =
  process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "../../.env.prod")
    : path.resolve(__dirname, "../../.env.dev");

const envFound = dotenv.config({ path: envFilePath });

if (envFound.error) {
  throw new Error(`⚠️  Couldn't find ${envFilePath} file  ⚠️`);
}

export default {
  port: parseInt(process.env.PORT as string, 10) as number,

  //? 데이터베이스
  database: process.env.DATABASE_URL as string,

  //? AWS
  s3AccessKey: process.env.S3_ACCESS_KEY as string,
  s3SecretKey: process.env.S3_SECRET_KEY as string,
  bucketName: process.env.S3_BUCKET as string,

  //? Email
  email: process.env.MANAGER_EMAIL as string,
  password: process.env.MANAGER_PASSWORD as string,
};
