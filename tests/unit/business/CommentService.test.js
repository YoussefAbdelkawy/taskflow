const CommentService = require('../../../src/business/services/CommentService');
const {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} = require('../../../src/business/errors/AppError');

const member = { id: 11, name: 'Karim', email: 'karim@taskflow.test' };
const task = { id: 31, projectId: 21 };

describe('CommentService', () => {
  let commentRepository;
  let taskRepository;
  let authorizationService;
  let service;

  beforeEach(() => {
    commentRepository = {
      create: jest.fn((comment) => ({ id: 41, ...comment })),
      findByTask: jest.fn(() => []),
    };
    taskRepository = { findById: jest.fn(() => task) };
    authorizationService = { isMember: jest.fn(() => true) };
    service = new CommentService({ commentRepository, taskRepository, authorizationService });
  });

  it('US4-1: trims and saves a non-empty comment with its author and timestamp', () => {
    const comment = service.addComment({
      taskId: task.id,
      content: '  Started on this  ',
      user: member,
    });

    expect(comment).toMatchObject({
      id: 41,
      taskId: task.id,
      userId: member.id,
      content: 'Started on this',
      createdAt: expect.any(String),
    });
    expect(new Date(comment.createdAt).toISOString()).toBe(comment.createdAt);
  });

  it.each(['', '   ', '\n\t'])(
    'US4-2: rejects an empty comment (%j) without saving it',
    (content) => {
      expect(() => service.addComment({ taskId: task.id, content, user: member })).toThrow(
        ValidationError,
      );
      expect(commentRepository.create).not.toHaveBeenCalled();
    },
  );

  it('returns 404 when the task does not exist', () => {
    taskRepository.findById.mockReturnValue(null);

    expect(() => service.addComment({ taskId: task.id, content: 'Update', user: member })).toThrow(
      NotFoundError,
    );
    expect(commentRepository.create).not.toHaveBeenCalled();
  });

  it('US4-3: rejects a user outside the project without saving a comment', () => {
    authorizationService.isMember.mockReturnValue(false);

    expect(() => service.addComment({ taskId: task.id, content: 'Update', user: member })).toThrow(
      ForbiddenError,
    );
    expect(commentRepository.create).not.toHaveBeenCalled();
  });

  it('lists comments only for a project member', () => {
    service.listComments(task.id, member);

    expect(commentRepository.findByTask).toHaveBeenCalledWith(task.id);
  });

  it('rejects a non-member from listing comments', () => {
    authorizationService.isMember.mockReturnValue(false);

    expect(() => service.listComments(task.id, member)).toThrow(ForbiddenError);
    expect(commentRepository.findByTask).not.toHaveBeenCalled();
  });
});
