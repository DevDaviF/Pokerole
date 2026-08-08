export default () => ({
  port: process.env.PORT ? Number(process.env.PORT) : 3001,
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
});
