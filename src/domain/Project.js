/** A project that groups tasks and members. startDate is text YYYY-MM-DD. */
class Project {
  constructor({ id, name, description, startDate }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.startDate = startDate;
  }
}

module.exports = Project;
