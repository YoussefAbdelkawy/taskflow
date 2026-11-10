const ProjectService = require('../../../src/business/services/ProjectService');
const {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} = require('../../../src/business/errors/AppError');
const { Role } = require('../../../src/domain/enums');

const manager = { id: 10, name: 'Mona', email: 'mona@taskflow.test' };
const member = { id: 11, name: 'Karim', email: 'karim@taskflow.test' };
const projectInput = { name: 'Website', description: 'Relaunch' };

describe('ProjectService', () => {
  let projectRepository;
  let userRepository;
  let authorizationService;
  let service;

  beforeEach(() => {
    projectRepository = {
      create: jest.fn((data) => ({ id: 21, ...data })),
      addMember: jest.fn(),
      findMemberRole: jest.fn(() => null),
      findByUser: jest.fn(() => []),
      findById: jest.fn(() => ({ id: 21, ...projectInput })),
    };
    userRepository = { findByEmail: jest.fn(() => member) };
    authorizationService = {
      isManager: jest.fn(() => true),
      isMember: jest.fn(() => true),
    };
    service = new ProjectService({
      projectRepository,
      userRepository,
      authorizationService,
    });
  });

  it('creates the project and makes its creator a manager', () => {
    const project = service.createProject(projectInput, manager);

    expect(project).toMatchObject({ id: 21, ...projectInput });
    expect(projectRepository.addMember).toHaveBeenCalledWith({
      projectId: project.id,
      userId: manager.id,
      role: Role.MANAGER,
    });
  });

  it('allows a manager to add a known user who is not already a member', () => {
    service.addMember({ projectId: 21, email: member.email, role: Role.MEMBER }, manager);

    expect(projectRepository.addMember).toHaveBeenCalledWith({
      projectId: 21,
      userId: member.id,
      role: Role.MEMBER,
    });
  });

  it('US4: a member adding someone gets 403 and no membership is saved', () => {
    authorizationService.isManager.mockReturnValue(false);

    expect(() =>
      service.addMember({ projectId: 21, email: member.email, role: Role.MEMBER }, member),
    ).toThrow(ForbiddenError);
    expect(projectRepository.addMember).not.toHaveBeenCalled();
  });

  it('returns 404 when the member email is unknown', () => {
    userRepository.findByEmail.mockReturnValue(null);

    expect(() =>
      service.addMember(
        { projectId: 21, email: 'missing@taskflow.test', role: Role.MEMBER },
        manager,
      ),
    ).toThrow(NotFoundError);
    expect(projectRepository.addMember).not.toHaveBeenCalled();
  });

  it('returns 409 when the user is already a project member', () => {
    projectRepository.findMemberRole.mockReturnValue(Role.MEMBER);

    expect(() =>
      service.addMember({ projectId: 21, email: member.email, role: Role.MEMBER }, manager),
    ).toThrow(ConflictError);
    expect(projectRepository.addMember).not.toHaveBeenCalled();
  });

  it('lists the signed-in user’s projects', () => {
    service.listMyProjects(manager);

    expect(projectRepository.findByUser).toHaveBeenCalledWith(manager.id);
  });

  it('allows a member to view a project', () => {
    expect(service.getProject(21, member)).toMatchObject({ id: 21 });
    expect(authorizationService.isMember).toHaveBeenCalledWith(member.id, 21);
  });

  it('rejects a non-member viewing a project', () => {
    authorizationService.isMember.mockReturnValue(false);

    expect(() => service.getProject(21, member)).toThrow(ForbiddenError);
  });
});
