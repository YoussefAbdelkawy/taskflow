/** A person who can log in. The password hash never lives on this model. */
class User {
  constructor({ id, name, email }) {
    this.id = id;
    this.name = name;
    this.email = email;
  }
}

module.exports = User;
