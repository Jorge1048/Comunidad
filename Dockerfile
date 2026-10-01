FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends qpdf && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV DATA_DIR=/data/jobs PORT=8080
EXPOSE 8080
CMD ["node","server.js"]
```[span_1](start_span)[span_1](end_span)
