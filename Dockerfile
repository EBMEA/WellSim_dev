# WellSim — zero-dependency Node server (no npm install step needed)
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY docs ./docs
ENV NODE_ENV=production
ENV PORT=3355
# The server binds 127.0.0.1 by default so a workstation run is not exposed to
# the network. Inside a container that would be unreachable from outside it, so
# the container — and only the container — opts into every interface. Publish
# the port deliberately; there is no authentication in front of this server.
ENV HOST=0.0.0.0
# case database lives here — mount a persistent volume at /app/data
VOLUME ["/app/data"]
EXPOSE 3355
USER node
CMD ["node", "src/server/server.js"]
