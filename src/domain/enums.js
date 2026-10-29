// Fixed lists of values shared by every layer. Each value equals its key, and the
// database stores these exact strings.

const TaskStatus = Object.freeze({
  TO_DO: 'TO_DO',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
});

const Priority = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
});

const Role = Object.freeze({
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
});

const Frequency = Object.freeze({
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
});

const NotificationType = Object.freeze({
  ASSIGNED: 'ASSIGNED',
  DUE_SOON: 'DUE_SOON',
  OVERDUE: 'OVERDUE',
});

module.exports = { TaskStatus, Priority, Role, Frequency, NotificationType };
