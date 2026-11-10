// InMemoryRepository plus the few feature queries the services need, so unit tests
// run without SQLite. They behave like the real repositories (copies, null when missing).
const InMemoryRepository = require('../../../src/data-access/repositories/InMemoryRepository');

class InMemoryUserRepository extends InMemoryRepository {
  findByEmail(email) {
    return this.findAll().find((user) => user.email === email) ?? null;
  }
}

class InMemoryProjectRepository extends InMemoryRepository {
  constructor(initialItems = []) {
    super(initialItems);
    this.members = [];
  }

  addMember(member) {
    this.members.push({ ...member });
    return { ...member };
  }

  findMemberRole({ projectId, userId }) {
    const member = this.members.find((m) => m.projectId === projectId && m.userId === userId);
    return member ? member.role : null;
  }
}

class InMemoryTaskRepository extends InMemoryRepository {
  findLatestByRecurrence(recurrenceId) {
    const instances = this.findAll().filter((task) => task.recurrenceId === recurrenceId);
    instances.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    return instances[0] ?? null;
  }

  findByRecurrenceAndDueDate({ recurrenceId, dueDate }) {
    const isMatch = (task) => task.recurrenceId === recurrenceId && task.dueDate === dueDate;
    return this.findAll().find(isMatch) ?? null;
  }

  // Like TaskRepository.findTasks: a filter that is undefined is not applied
  findTasks({ assigneeId, priority, status }) {
    const filter = Object.entries({ assigneeId, priority, status }).filter(
      ([, value]) => value !== undefined,
    );
    return this.findAll().filter((task) => filter.every(([field, value]) => task[field] === value));
  }
}

class InMemoryRecurrenceRuleRepository extends InMemoryRepository {
  findActive() {
    return this.findAll().filter((rule) => rule.isActive);
  }
}

module.exports = {
  InMemoryUserRepository,
  InMemoryProjectRepository,
  InMemoryTaskRepository,
  InMemoryRecurrenceRuleRepository,
};
