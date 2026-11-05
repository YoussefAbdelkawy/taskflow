const {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} = require('../errors/AppError');
const { Role } = require('../../domain/enums');

class ProjectService {
  constructor({ projectRepository, userRepository, authorizationService }) {
    this.projectRepository = projectRepository;
    this.userRepository = userRepository;
    this.authorizationService = authorizationService;
  }

  /**
   * @param {{ name: string, description?: string }} input
   * @param {{ id: number }} user
   * @returns {object} the saved project
   * requires: user is logged in; name is a non-empty string
   * effects: creates a project and makes its creator a MANAGER
   * modifies: projects and project_members
   */
  createProject({ name, description = '' }, user) {
    // Imperative: reject invalid fields before creating either project row.
    if (typeof name !== 'string' || !name.trim()) {
      throw new ValidationError('Project name is required');
    }
    if (typeof description !== 'string') {
      throw new ValidationError('Project description must be text');
    }

    const project = this.projectRepository.create({
      name: name.trim(),
      description: description.trim(),
      startDate: new Date().toISOString().split('T')[0],
    });
    this.projectRepository.addMember({
      projectId: project.id,
      userId: user.id,
      role: Role.MANAGER,
    });
    return project;
  }

  /**
   * @param {{ projectId: number, email: string, role: string }} membership
   * @param {{ id: number }} user
   * @returns {{ userId: number, name: string, email: string, role: string }} the added member
   * requires: user is logged in and is a project manager; email belongs to a user; role is valid
   * effects: adds the user to the project
   * modifies: project_members
   */
  addMember({ projectId, email, role }, user) {
    const project = this.projectRepository.findById(projectId);
    if (!project) throw new NotFoundError(`Project ${projectId} not found`);
    if (!this.authorizationService.isManager(user.id, projectId)) {
      throw new ForbiddenError('Only a project manager can add members');
    }
    if (!Object.values(Role).includes(role)) {
      throw new ValidationError('Role must be MANAGER or MEMBER');
    }
    if (typeof email !== 'string' || !email.trim()) {
      throw new ValidationError('Member email is required');
    }

    const member = this.userRepository.findByEmail(email.trim().toLowerCase());
    if (!member) throw new NotFoundError('User not found');
    if (this.projectRepository.findMemberRole({ projectId, userId: member.id })) {
      throw new ConflictError('User is already a project member');
    }

    this.projectRepository.addMember({ projectId, userId: member.id, role });
    return { userId: member.id, name: member.name, email: member.email, role };
  }

  /**
   * @param {{ id: number }} user
   * @returns {object[]} projects the user belongs to
   * requires: user is logged in
   * effects: returns only projects of which the user is a member
   * modifies: nothing
   */
  listMyProjects(user) {
    return this.projectRepository.findByUser(user.id);
  }

  /**
   * @param {number} projectId
   * @param {{ id: number }} user
   * @returns {object} the project
   * requires: user is logged in and belongs to the project
   * effects: returns the project or throws NotFoundError / ForbiddenError
   * modifies: nothing
   */
  getProject(projectId, user) {
    const project = this.projectRepository.findById(projectId);
    if (!project) throw new NotFoundError(`Project ${projectId} not found`);
    if (!this.authorizationService.isMember(user.id, projectId)) {
      throw new ForbiddenError('Only project members can view this project');
    }
    return project;
  }
}

module.exports = ProjectService;
