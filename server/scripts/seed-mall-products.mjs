/**
 * 将 mall_products 补足至约 50 条演示数据（已存在则只插入缺失条数）。
 * 用法：在 server 目录执行 node scripts/seed-mall-products.mjs
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mysql from "mysql2/promise";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TARGET = 50;

const titles = [
  "辰星文创 纪念徽章",
  "电影主题 明信片套装",
  "动漫协会 限定贴纸包",
  "文化展 导览手册",
  "限定帆布袋 单肩款",
  "手账本 精装礼盒",
  "陶瓷马克杯 印花款",
  "纯棉短袜 三双装",
  "亚克力立牌 角色款",
  "金属书签 镂空款",
];

function pickTitle(i) {
  const base = titles[i % titles.length];
  return `${base} · 纪念款 ${String(i).padStart(2, "0")}`;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  const [countRows] = await conn.query("SELECT COUNT(*) AS c FROM mall_products");
  const current = Number(countRows[0]?.c ?? 0) || 0;
  const need = Math.max(0, TARGET - current);
  if (need === 0) {
    console.log(`mall_products 已有 ${current} 条，无需插入。`);
    await conn.end();
    return;
  }

  const sqlPath = path.join(__dirname, "..", "sql", "generated_mall_seed.sql");
  const stmts = [];

  for (let k = 0; k < need; k += 1) {
    const i = current + k + 1;
    const title = pickTitle(i).replace(/'/g, "''");
    const price = (19.9 + (i % 17) * 7.5).toFixed(2);
    const sold = 100 + (i * 137) % 20000;
    const aspect = (0.85 + ((i * 13) % 55) / 100).toFixed(3);
    const seed = `hmock${i}`;
    const cover = `https://picsum.photos/seed/${seed}/400/480`;
    const d1 = `https://picsum.photos/seed/${seed}a/750/800`;
    const d2 = `https://picsum.photos/seed/${seed}b/750/820`;
    const desc = `辰星文化商城演示商品 No.${i}，图片为占位，可后续替换为实际上架素材。`.replace(/'/g, "''");

    const sql = `INSERT INTO mall_products (title, price, sold_count, cover_url, cover_aspect, detail_images, description, status) VALUES (
  '${title}',
  ${price},
  ${sold},
  '${cover}',
  ${aspect},
  JSON_ARRAY('${d1}','${d2}'),
  '${desc}',
  1
)`;
    stmts.push(sql);
  }

  const fileBody = `-- 由 scripts/seed-mall-products.mjs 生成\n\n${stmts.join(";\n\n")};\n`;
  fs.writeFileSync(sqlPath, fileBody, "utf8");

  for (const s of stmts) {
    await conn.query(s);
  }

  const [afterRows] = await conn.query("SELECT COUNT(*) AS c FROM mall_products");
  const totalNow = Number(afterRows[0]?.c ?? 0) || 0;
  console.log(`已插入 ${need} 条，当前 mall_products 共 ${totalNow} 条。SQL 已写入 ${sqlPath}`);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
