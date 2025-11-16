import { Injectable } from "@nestjs/common";
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
  register,
} from "prom-client";

let defaultMetricsRegistered = false;

@Injectable()
export class MetricsService {
  private readonly reg: Registry;
  private readonly signupCounter: Counter<string>;
  private readonly loginCounter: Counter<string>;
  private readonly wsConnectCounter: Counter<string>;
  private readonly wsTypingCounter: Counter<string>;
  private readonly wsChatCounter: Counter<string>;
  private readonly paymentInitiateCounter: Counter<string>;
  private readonly reminderSentCounter: Counter<string>;
  private readonly reminderFailedCounter: Counter<string>;
  private readonly httpHistogram: Histogram<string>;

  constructor() {
    this.reg = register;
    if (!defaultMetricsRegistered) {
      collectDefaultMetrics();
      defaultMetricsRegistered = true;
    }

    this.signupCounter = new Counter({
      name: "auth_signup_total",
      help: "Total signups",
      labelNames: ["role"] as const,
      registers: [this.reg],
    });
    this.loginCounter = new Counter({
      name: "auth_login_total",
      help: "Total logins",
      labelNames: ["role"] as const,
      registers: [this.reg],
    });
    this.wsConnectCounter = new Counter({
      name: "ws_connect_total",
      help: "Total websocket connects",
      labelNames: ["role", "redis"] as const,
      registers: [this.reg],
    });
    this.wsTypingCounter = new Counter({
      name: "ws_typing_total",
      help: "Total typing events",
      labelNames: ["room"] as const,
      registers: [this.reg],
    });
    this.wsChatCounter = new Counter({
      name: "ws_chat_send_total",
      help: "Total chat messages sent",
      labelNames: ["room"] as const,
      registers: [this.reg],
    });

    this.paymentInitiateCounter = new Counter({
      name: "payment_initiate_total",
      help: "Total customer-verified completions that initiate payment",
      labelNames: ["source"] as const,
      registers: [this.reg],
    });

    this.reminderSentCounter = new Counter({
      name: "reminder_sent_total",
      help: "Total assignment reminders sent",
      labelNames: ["status"] as const,
      registers: [this.reg],
    });

    this.reminderFailedCounter = new Counter({
      name: "reminder_failed_total",
      help: "Total reminder failures (enqueue/process)",
      labelNames: ["reason"] as const,
      registers: [this.reg],
    });

    this.httpHistogram = new Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      buckets: [0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      labelNames: ["method", "route", "status_code"] as const,
      registers: [this.reg],
    });
  }

  incSignup(role: string) {
    this.signupCounter.labels(role?.toUpperCase?.() || "UNKNOWN").inc();
  }

  incLogin(role: string) {
    this.loginCounter.labels(role?.toUpperCase?.() || "UNKNOWN").inc();
  }

  incWsConnect(role: string, redis: boolean) {
    this.wsConnectCounter
      .labels(role?.toUpperCase?.() || "UNKNOWN", String(!!redis))
      .inc();
  }

  incWsTyping(room: string) {
    this.wsTypingCounter.labels(room || "unknown").inc();
  }

  incWsChat(room: string) {
    this.wsChatCounter.labels(room || "unknown").inc();
  }

  incPaymentInitiate(source: string = "job_complete") {
    this.paymentInitiateCounter.labels(source).inc();
  }

  incReminderSent(status: string) {
    this.reminderSentCounter.labels(status?.toUpperCase?.() || "UNKNOWN").inc();
  }

  incReminderFailed(reason: string) {
    this.reminderFailedCounter.labels(reason || "unknown").inc();
  }

  recordHttpDuration(
    method: string,
    route: string,
    statusCode: number,
    seconds: number,
  ) {
    const m = (method || "GET").toUpperCase();
    const r = sanitizeRoute(route || "/");
    const s = String(statusCode || 200);
    this.httpHistogram.labels(m, r, s).observe(seconds);
  }
}

export type HttpLabels = { method: string; route: string; status_code: string };

export function sanitizeRoute(route: string): string {
  // avoid high cardinality by trimming query, ensuring leading slash
  try {
    const r = route.split("?")[0];
    return r || "/";
  } catch {
    return "/";
  }
}

export class MetricsHttpHelper {
  constructor(private metrics: MetricsService) {}
  record(method: string, route: string, statusCode: number, seconds: number) {
    const labels: HttpLabels = {
      method: (method || "GET").toUpperCase(),
      route: sanitizeRoute(route || "/"),
      status_code: String(statusCode || 200),
    };
    this.metrics.recordHttpDuration(
      labels.method,
      labels.route,
      Number(labels.status_code),
      seconds,
    );
  }
}
