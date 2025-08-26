import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { getServerConfigFromServer } from "../core/configuration/ConfigLoader";
import { resourceFromAttributes } from "@opentelemetry/resources";

const config = getServerConfigFromServer();

export function getOtelResource() {
  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "openfront",
    [ATTR_SERVICE_VERSION]: "1.0.0",
    ...getPromLabels(),
  });
}

export function getPromLabels() {
  return {
    "service.instance.id": process.env.HOSTNAME,
    /* eslint-disable sort-keys */
    "openfront.environment": config.env(),
    "openfront.host": process.env.HOST,
    "openfront.domain": process.env.DOMAIN,
    "openfront.subdomain": process.env.SUBDOMAIN,
    "openfront.component": process.env.WORKER_ID
      ? "Worker " + process.env.WORKER_ID
      : "Master",
    /* eslint-enable sort-keys */
  };
}
