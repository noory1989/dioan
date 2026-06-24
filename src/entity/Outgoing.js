const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Outgoing',
  tableName: 'outgoing',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    serial: {
      type: 'varchar',
      length: 50,
      nullable: false,
    },
    date: {
      type: 'date',
      nullable: true,
    },
    recipient: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    subject: {
      type: 'text',
      nullable: true,
    },
    oldNo: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    oldDate: {
      type: 'date',
      nullable: true,
    },
    transfer: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    newNo: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    newDate: {
      type: 'date',
      nullable: true,
    },
    attachments: {
      type: 'longtext',
      nullable: true,
    },
    createdAt: {
      type: 'datetime',
      createDate: true,
    }
  }
});
