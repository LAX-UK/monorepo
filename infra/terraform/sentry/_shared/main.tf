locals {
  apps = {
    web = {
      platform             = "javascript-nextjs"
      traces_sample_rate   = 0.05
      profiles_sample_rate = 0.05
      public_dsn           = true
      p95_ms               = 1500
    }
    api = {
      platform             = "node"
      traces_sample_rate   = 0.10
      profiles_sample_rate = 0.05
      public_dsn           = false
      p95_ms               = 800
    }
    auth = {
      platform             = "node"
      traces_sample_rate   = 0.10
      profiles_sample_rate = 0.05
      public_dsn           = false
      p95_ms               = 800
    }
    ws = {
      platform             = "node"
      traces_sample_rate   = 0.05
      profiles_sample_rate = 0
      public_dsn           = false
      p95_ms               = 200
    }
    worker = {
      platform             = "node"
      traces_sample_rate   = 0.10
      profiles_sample_rate = 0
      public_dsn           = false
      p95_ms               = null
    }
  }

  routing = {
    prod = {
      critical = ["slack_alerts_engineering", "pagerduty_primary", "email_support"]
      warning  = ["slack_alerts_engineering"]
    }
    test = {
      critical = ["slack_alerts_engineering"]
      warning  = ["slack_alerts_engineering"]
    }
  }

  # Slugs exported to worker env; monitors upserted by SDK check-ins (provider v0.14.13 has no sentry_cron_monitor).
  worker_crons = {
    payout-settlement = {
      schedule       = "0 9 * * 1"
      checkin_margin = 5
      max_runtime    = 30
      timezone       = "UTC"
    }
    email-outbox-drain = {
      schedule       = "* * * * *"
      checkin_margin = 2
      max_runtime    = 5
      timezone       = "UTC"
    }
    marketing-outbox-poller = {
      schedule       = "* * * * *"
      checkin_margin = 2
      max_runtime    = 5
      timezone       = "UTC"
    }
  }

  inbound_filters = toset([
    "browser-extensions",
    "legacy-browsers",
    "localhost",
    "web-crawlers",
    "filtered-transaction",
  ])
}
