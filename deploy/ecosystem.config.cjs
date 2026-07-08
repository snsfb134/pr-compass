module.exports = {
  apps: [
    {
      name: "pr-compass-api",
      cwd: "/srv/pr-compass-deploy",
      script: ".venv/bin/uvicorn",
      args: "app.main:app --host 127.0.0.1 --port 8010",
      interpreter: "none",
      env: {
        PR_COMPASS_DATA_DIR: "/srv/pr-compass-data",
        PR_COMPASS_WEB_APP_URL: "https://YOUR_FREE_DOMAIN",
        SMTP_HOST: "smtp.gmail.com",
        SMTP_PORT: "587",
        SMTP_USERNAME: "",
        SMTP_PASSWORD: "",
        SMTP_FROM_EMAIL: "",
        SMTP_USE_SSL: "false",
      },
    },
    {
      name: "pr-compass-web",
      cwd: "/srv/pr-compass-deploy/web",
      script: "server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
        NEXT_PUBLIC_API_BASE_URL: "/backend",
      },
    },
  ],
};
