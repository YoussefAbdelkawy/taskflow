class NotificationController {
  constructor({ notificationService }) {
    this.notificationService = notificationService;
  }

  listMine = (req, res) => {
    res.json(this.notificationService.listMine(req.user));
  };

  unreadCount = (req, res) => {
    res.json({ count: this.notificationService.unreadCount(req.user) });
  };

  markRead = (req, res) => {
    res.json(this.notificationService.markRead({ id: Number(req.params.id), user: req.user }));
  };
}

module.exports = NotificationController;
