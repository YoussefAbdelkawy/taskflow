/**
 * The smallest possible controller. Use it as a template for yours.
 *
 * A controller's only job:
 *   1. read the request (req.params, req.query, req.body)
 *   2. call ONE service method
 *   3. send the result back as JSON
 * No business rules and no database code in here.
 */
class HealthController {
  // Arrow functions keep `this` correct when Express calls the method.
  getStatus = (_req, res) => {
    res.json({ status: 'ok' });
  };
}

module.exports = HealthController;
