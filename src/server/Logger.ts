import * as dotenv from "dotenv";
import * as logsAPI from "@opentelemetry/api-logs";
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OpenTelemetryTransportV3 } from "@opentelemetry/winston-transport";
import { getOtelResource } from "./OtelResource";
import { getServerConfigFromServer } from "../core/configuration/ConfigLoader";
import winston from "winston";
dotenv.config();

const config = getServerConfigFromServer();

const resource = getOtelResource();

// Initialize the OpenTelemetry Logger Provider
const loggerProvider = new LoggerProvider({
  resource,
});

if (config.otelEnabled()) {
  console.log("OTEL enabled");
  // Configure OpenTelemetry endpoint with basic auth (if provided)
  const headers: Record<string, string> = {};
  headers["Authorization"] = config.otelAuthHeader();

  // Add OTLP exporter for logs
  const logExporter = new OTLPLogExporter({
    url: `${config.otelEndpoint()}/v1/logs`,
    // eslint-disable-next-line sort-keys
    headers,
  });

  // Add a log processor with the exporter
  loggerProvider.addLogRecordProcessor(
    new SimpleLogRecordProcessor(logExporter),
  );

  // Set as the global logger provider
  logsAPI.logs.setGlobalLoggerProvider(loggerProvider);
} else {
  console.log(
    "No OTLP endpoint and credentials provided, remote logging disabled",
  );
}

// Custom format to add severity tag based on log level
const addSeverityFormat = winston.format((info) => {
  return {
    ...info,
    severity: info.level,
  };
});

// Define your base/parent logger
const logger = winston.createLogger({
  level: "info",
  /* eslint-disable sort-keys */
  format: winston.format.combine(
    winston.format.timestamp(),
    addSeverityFormat(),
    winston.format.json(),
  ),
  defaultMeta: {
    service: "openfront",
    environment: process.env.GAME_ENV ?? "prod",
  },
  /* eslint-enable sort-keys */
  transports: [
    new winston.transports.Console(),
    new OpenTelemetryTransportV3(),
  ],
});

// Export both the main logger and the child logger factory
export { logger };
