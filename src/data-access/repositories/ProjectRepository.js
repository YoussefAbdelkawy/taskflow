const BaseRepository = require('./BaseRepository');
const { toRow, insertRow, updateRow, deleteRow } = require('./sqlHelpers');

const TABLE = 'projects';
const COLUMNS = Object.freeze({
  name: 'name',
  description: 'description',
  startDate: 'start_date',
});

const toProject = (row) =>
  row
    ? { id: row.id, name: row.name, description: row.description, startDate: row.start_date }
    : null;

const toMember = (row) => ({
  userId: row.user_id,
  name: row.name,
  email: row.email,
  role: row.project_role,
});

/** Projects and their members (project_members) in SQLite. */
class ProjectRepository extends BaseRepository {
  constructor(db) {
    super();
    this.db = db;
  }

  findById(id) {
    return toProject(this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
  }

  findAll() {
    return this.db.prepare('SELECT * FROM projects ORDER BY id').all().map(toProject);
  }

  create(data) {
    return this.findById(insertRow(this.db, { table: TABLE, row: toRow(data, COLUMNS) }));
  }

  update(id, changes) {
    const found = updateRow(this.db, { table: TABLE, id, row: toRow(changes, COLUMNS) });
    return found ? this.findById(id) : null;
  }

  delete(id) {
    return deleteRow(this.db, { table: TABLE, id });
  }

  /**
   * @param {{ projectId: number, userId: number, role: string }} member
   * @returns {{ projectId: number, userId: number, role: string }}
   * modifies: project_members
   */
  addMember({ projectId, userId, role }) {
    this.db
      .prepare('INSERT INTO project_members (project_id, user_id, project_role) VALUES (?, ?, ?)')
      .run(projectId, userId, role);
    return { projectId, userId, role };
  }

  /**
   * @param {number} projectId
   * @returns {{ userId: number, name: string, email: string, role: string }[]}
   */
  findMembers(projectId) {
    return this.db
      .prepare(
        `SELECT pm.user_id, u.name, u.email, pm.project_role
         FROM project_members pm
         JOIN users u ON u.id = pm.user_id
         WHERE pm.project_id = ?
         ORDER BY u.id`,
      )
      .all(projectId)
      .map(toMember);
  }

  /**
   * @param {{ projectId: number, userId: number }} membership
   * @returns {'MANAGER' | 'MEMBER' | null}
   */
  findMemberRole({ projectId, userId }) {
    const row = this.db
      .prepare('SELECT project_role FROM project_members WHERE project_id = ? AND user_id = ?')
      .get(projectId, userId);
    return row ? row.project_role : null;
  }

  /**
   * @param {number} userId
   * @returns {object[]} the projects this user is a member of
   */
  findByUser(userId) {
    return this.db
      .prepare(
        `SELECT p.* FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
         WHERE pm.user_id = ?
         ORDER BY p.id`,
      )
      .all(userId)
      .map(toProject);
  }
}

module.exports = ProjectRepository;
