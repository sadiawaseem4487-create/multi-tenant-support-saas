import * as Sentry from "@sentry/nextjs";
import { getSentryOptions } from "./sentry.shared";

const options = getSentryOptions();
if (options) {
  Sentry.init(options);
}
