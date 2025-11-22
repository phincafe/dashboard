  /**
   * WEEKLY HOURLY: /api/sales/hourly/weekly?week=YYYY-MM-DD&comparePrev=true
   * Aggregates that entire week into an hourly profile, plus optional previous week comparison.
   */
  app.get("/api/sales/hourly/weekly", async (req, res) => {
    const weekStr = req.query.week;
    const comparePrev = req.query.comparePrev === "true";
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!weekStr) {
      return res.status(400).json({ error: "Missing week=YYYY-MM-DD" });
    }

    try {
      const target = DateTime.fromISO(weekStr, { zone: timezone });
      if (!target.isValid) {
        return res.status(400).json({ error: "Invalid week date" });
      }

      const start = target.startOf("week");
      const end = target.endOf("week");

      const locationsResp = await client.locations.list();
      const locationsRaw = locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));

      const summary = await buildHourlySummaryForRange(
        start,
        end,
        timezone,
        client,
        locations
      );

      let comparison = null;
      if (comparePrev) {
        const prevStart = start.minus({ weeks: 1 });
        const prevEnd = end.minus({ weeks: 1 });

        const prevSummary = await buildHourlySummaryForRange(
          prevStart,
          prevEnd,
          timezone,
          client,
          locations
        );

        comparison = {
          ...prevSummary,
          range: {
            start: prevStart.toISODate(),
            end: prevEnd.toISODate(),
          },
        };
      }

      res.json({
        ...summary,
        type: "weekly",
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        comparison,
      });
    } catch (err) {
      console.error("Error fetching hourly sales (weekly):", err);

      if (err instanceof SquareError) {
        return res.status(502).json({
          error: "Square API error",
          details: err.body,
        });
      }

      res.status(500).json({
        error: "Unexpected server error",
      });
    }
  });

  /**
   * MONTHLY HOURLY: /api/sales/hourly/monthly?month=YYYY-MM&comparePrev=true
   * Aggregates that entire calendar month into an hourly profile, plus optional previous month comparison.
   */
  app.get("/api/sales/hourly/monthly", async (req, res) => {
    const monthStr = req.query.month; // YYYY-MM
    const comparePrev = req.query.comparePrev === "true";
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!monthStr) {
      return res.status(400).json({ error: "Missing month=YYYY-MM" });
    }

    try {
      const start = DateTime.fromISO(monthStr + "-01", {
        zone: timezone,
      }).startOf("month");
      if (!start.isValid) {
        return res.status(400).json({ error: "Invalid month format" });
      }
      const end = start.endOf("month");

      const locationsResp = await client.locations.list();
      const locationsRaw = locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));

      const summary = await buildHourlySummaryForRange(
        start,
        end,
        timezone,
        client,
        locations
      );

      let comparison = null;
      if (comparePrev) {
        const prevStart = start.minus({ months: 1 }).startOf("month");
        const prevEnd = prevStart.endOf("month");

        const prevSummary = await buildHourlySummaryForRange(
          prevStart,
          prevEnd,
          timezone,
          client,
          locations
        );

        comparison = {
          ...prevSummary,
          range: {
            start: prevStart.toISODate(),
            end: prevEnd.toISODate(),
          },
        };
      }

      res.json({
        ...summary,
        type: "monthly",
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        comparison,
      });
    } catch (err) {
      console.error("Error fetching hourly sales (monthly):", err);

      if (err instanceof SquareError) {
        return res.status(502).json({
          error: "Square API error",
          details: err.body,
        });
      }

      res.status(500).json({
        error: "Unexpected server error",
      });
    }
  });

  /**
   * YEARLY HOURLY: /api/sales/hourly/yearly?year=YYYY&comparePrev=true
   * Aggregates that entire calendar year into an hourly profile, plus optional previous year comparison.
   */
  app.get("/api/sales/hourly/yearly", async (req, res) => {
    const yearStr = req.query.year;
    const comparePrev = req.query.comparePrev === "true";
    const timezone = process.env.STORE_TIMEZONE || "America/Los_Angeles";

    if (!yearStr) {
      return res.status(400).json({ error: "Missing year=YYYY" });
    }

    try {
      const start = DateTime.fromISO(yearStr + "-01-01", {
        zone: timezone,
      }).startOf("year");
      if (!start.isValid) {
        return res.status(400).json({ error: "Invalid year format" });
      }
      const end = start.endOf("year");

      const locationsResp = await client.locations.list();
      const locationsRaw = locationsResp.locations || [];
      const locations = locationsRaw.map((loc) => ({
        id: loc.id,
        name: loc.name || loc.id,
      }));

      const summary = await buildHourlySummaryForRange(
        start,
        end,
        timezone,
        client,
        locations
      );

      let comparison = null;
      if (comparePrev) {
        const prevStart = start.minus({ years: 1 }).startOf("year");
        const prevEnd = prevStart.endOf("year");

        const prevSummary = await buildHourlySummaryForRange(
          prevStart,
          prevEnd,
          timezone,
          client,
          locations
        );

        comparison = {
          ...prevSummary,
          range: {
            start: prevStart.toISODate(),
            end: prevEnd.toISODate(),
          },
        };
      }

      res.json({
        ...summary,
        type: "yearly",
        range: {
          start: start.toISODate(),
          end: end.toISODate(),
        },
        comparison,
      });
    } catch (err) {
      console.error("Error fetching hourly sales (yearly):", err);

      if (err instanceof SquareError) {
        return res.status(502).json({
          error: "Square API error",
          details: err.body,
        });
      }

      res.status(500).json({
        error: "Unexpected server error",
      });
    }
  });
