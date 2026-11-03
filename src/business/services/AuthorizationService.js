const { Role } = require('../../domain/enums');

/**
 * Answers "what may this user do in this project?" for every feature (NFR Security).
 * It only returns true or false; the calling service decides to throw ForbiddenError (403).
 */
class AuthorizationService {
  constructor({ projectRepository }) {
    this.projectRepository = projectRepository;
  }

  /**
   * @param {number} userId
   * @param {number} projectId
   * @returns {boolean}
   * requires: userId and projectId are ids
   * effects: returns true only if the user is a MANAGER of this project
   * modifies: nothing
   */
  isManager(userId, projectId) {
    return this.projectRepository.findMemberRole({ projectId, userId }) === Role.MANAGER;
  }

  /**
   * @param {number} userId
   * @param {number} projectId
   * @returns {boolean}
   * requires: userId and projectId are ids
   * effects: returns true only if the user is a MANAGER or MEMBER of this project
   *          (managers count as members)
   * modifies: nothing
   */
  isMember(userId, projectId) {
    const role = this.projectRepository.findMemberRole({ projectId, userId });
    // Declarative: "is the role one of the known roles?", whatever a non-member returns
    return Object.values(Role).includes(role);
  }
}

module.exports = AuthorizationService;
