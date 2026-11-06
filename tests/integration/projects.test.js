// Fady's project flow through the real app and an in-memory SQLite database.
const request = require('supertest');
const { createContainer } = require('../../src/container');
const { createApp } = require('../../src/app');

function addTeam(container) {
  const { user, project } = container.repositories;
  const addUser = (name) =>
    user.create({
      name,
      email: `${name.toLowerCase()}@taskflow.test`,
      passwordHash: 'test-hash',
    });
  const team = {
    mona: addUser('Mona'),
    karim: addUser('Karim'),
    omar: addUser('Omar'),
    hany: addUser('Hany'),
  };
  const website = project.create({ name: 'Website', description: '', startDate: '2026-11-05' });
  project.addMember({ projectId: website.id, userId: team.mona.id, role: 'MANAGER' });
  project.addMember({ projectId: website.id, userId: team.karim.id, role: 'MEMBER' });
  project.addMember({ projectId: website.id, userId: team.omar.id, role: 'MEMBER' });
  return { team, website };
}

describe('projects API (Fady turn)', () => {
  let app;
  let container;
  let team;
  let website;
  const auth = {};

  beforeEach(() => {
    container = createContainer({ databasePath: ':memory:' });
    ({ team, website } = addTeam(container));
    app = createApp(container);
    for (const name of Object.keys(team)) {
      const token = container.repositories.session.create(team[name].id);
      auth[name] = `Bearer ${token}`;
    }
  });

  describe('projects API', () => {
    it('lists and returns projects that belong to the signed-in member', async () => {
      const list = await request(app).get('/api/projects').set('Authorization', auth.karim);
      const project = await request(app)
        .get(`/api/projects/${website.id}`)
        .set('Authorization', auth.karim);

      expect(list.status).toBe(200);
      expect(list.body).toEqual([website]);
      expect(project.status).toBe(200);
      expect(project.body).toEqual(website);
    });

    it('rejects a non-member from viewing a project', async () => {
      const response = await request(app)
        .get(`/api/projects/${website.id}`)
        .set('Authorization', auth.hany);

      expect(response.status).toBe(403);
    });

    it('serves the projects page with its create form and script', async () => {
      const page = await request(app).get('/projects.html');
      const script = await request(app).get('/js/projects.js');

      expect(page.status).toBe(200);
      expect(page.text).toContain('<header id="app-header"></header>');
      expect(page.text).toContain('id="new-project-form"');
      expect(page.text).toContain('js/projects.js');
      expect(script.status).toBe(200);
    });

    it('US M1: the project creator becomes its manager', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', auth.mona)
        .send({ name: 'Roadmap', description: 'Next quarter' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ name: 'Roadmap', description: 'Next quarter' });
      expect(
        container.repositories.project.findMemberRole({
          projectId: response.body.id,
          userId: team.mona.id,
        }),
      ).toBe('MANAGER');
    });

    it('allows a manager to add a member by email', async () => {
      const project = await request(app)
        .post('/api/projects')
        .set('Authorization', auth.mona)
        .send({ name: 'Roadmap', description: '' });
      const response = await request(app)
        .post(`/api/projects/${project.body.id}/members`)
        .set('Authorization', auth.mona)
        .send({ email: team.karim.email, role: 'MEMBER' });

      expect(project.status).toBe(201);
      expect(response.status).toBe(201);
      expect(
        container.repositories.project.findMemberRole({
          projectId: project.body.id,
          userId: team.karim.id,
        }),
      ).toBe('MEMBER');
    });

    it('rejects a member who tries to add someone, without saving the membership', async () => {
      const response = await request(app)
        .post(`/api/projects/${website.id}/members`)
        .set('Authorization', auth.karim)
        .send({ email: team.hany.email, role: 'MEMBER' });

      expect(response.status).toBe(403);
      expect(
        container.repositories.project.findMemberRole({
          projectId: website.id,
          userId: team.hany.id,
        }),
      ).toBeNull();
    });

    it('returns 409 when a manager adds an existing project member', async () => {
      const response = await request(app)
        .post(`/api/projects/${website.id}/members`)
        .set('Authorization', auth.mona)
        .send({ email: team.karim.email, role: 'MEMBER' });

      expect(response.status).toBe(409);
    });
  });
});
