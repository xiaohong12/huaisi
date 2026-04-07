/**
 * 集中读取环境变量；数据库相关项见 MYSQL_*，未设置时使用本地开发默认值。
 */
export default {
  port: Number(process.env.PORT) || 7001,
  env: process.env.NODE_ENV || 'development',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'remote_user',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'huasi',
    /** 连接池最大连接数 */
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT) || 10
  },
  /**
   * 微信小程序登录配置：用于 code 换 openid。
   */
  wechatMini: {
    appId: process.env.WX_MINI_APP_ID || '',
    appSecret: process.env.WX_MINI_APP_SECRET || ''
  }
};
