const AuthorizationService = require('../../../src/business/services/AuthorizationService');
const { InMemoryProjectRepository } = require('../helpers/inMemoryRepositories');
const { Role } = require('../../../src/domain/enums');

describe('AuthorizationService', () => {
  const PROJECT_ID = 1;
  const OTHER_PROJECT_ID = 2;
  const MANAGER_ID = 10;
  const MEMBER_ID = 11;
  const OUTSIDER_ID = 12;

  let authorization;

  beforeEach(() => {
    const projectRepository = new InMemoryProjectRepository();
    projectRepository.addMember({ projectId: PROJECT_ID, userId: MANAGER_ID, role: Role.MANAGER });
    projectRepository.addMember({ projectId: PROJECT_ID, userId: MEMBER_ID, role: Role.MEMBER });
    projectRepository.addMember({
      projectId: OTHER_PROJECT_ID,
      userId: OUTSIDER_ID,
      role: Role.MANAGER,
    });
    authorization = new AuthorizationService({ projectRepository });
  });

  describe('isManager', () => {
    it('NFR Security: is true for a manager of the project', () => {
      expect(authorization.isManager(MANAGER_ID, PROJECT_ID)).toBe(true);
    });

    it('NFR Security: is false for a member who is not a manager', () => {
      expect(authorization.isManager(MEMBER_ID, PROJECT_ID)).toBe(false);
    });

    it('NFR Security: is false for a manager of a different project', () => {
      expect(authorization.isManager(OUTSIDER_ID, PROJECT_ID)).toBe(false);
    });
  });

  describe('isMember', () => {
    it('NFR Security: is true for a member of the project', () => {
      expect(authorization.isMember(MEMBER_ID, PROJECT_ID)).toBe(true);
    });

    it('NFR Security: is true for a manager (managers count as members)', () => {
      expect(authorization.isMember(MANAGER_ID, PROJECT_ID)).toBe(true);
    });

    it('NFR Security: is false for a user who is not in the project', () => {
      expect(authorization.isMember(OUTSIDER_ID, PROJECT_ID)).toBe(false);
    });
  });
});
