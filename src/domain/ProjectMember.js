/** Links a user to a project with a Role (MANAGER or MEMBER). */
class ProjectMember {
  constructor({ projectId, userId, role }) {
    this.projectId = projectId;
    this.userId = userId;
    this.role = role;
  }
}

module.exports = ProjectMember;
