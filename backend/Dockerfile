FROM node:20-bookworm-slim

COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.1 /lambda-adapter /opt/extensions/lambda-adapter

ENV NODE_ENV=production \
    PORT=8080 \
    AWS_LWA_PORT=8080 \
    AWS_LWA_READINESS_CHECK_PATH=/health

WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/src ./src
COPY infrastructure/rds-ca-global.pem /opt/rds-ca-global.pem

USER node
EXPOSE 8080
CMD ["node", "src/index.js"]
