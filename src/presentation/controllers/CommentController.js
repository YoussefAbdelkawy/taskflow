const CREATED = 201;

/** HTTP in, JSON out for task comments. */
class CommentController {
  constructor({ commentService }) {
    this.commentService = commentService;
  }

  add = (req, res) => {
    const comment = this.commentService.addComment({
      taskId: Number(req.params.id),
      content: req.body?.content,
      user: req.user,
    });
    res.status(CREATED).json(comment);
  };

  list = (req, res) => {
    res.json(this.commentService.listComments(Number(req.params.id), req.user));
  };
}

module.exports = CommentController;
