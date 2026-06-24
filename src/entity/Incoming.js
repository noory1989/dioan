const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Incoming',
  tableName: 'incoming',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    arrivePlace: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    arriveNo: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    arriveDate: {
      type: 'date',
      nullable: true,
    },
    inNo: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    inDate: {
      type: 'date',
      nullable: true,
    },
    requesterName: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    requestType: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    subject: {
      type: 'text',
      nullable: true,
    },
    phone: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    transferTo: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    outNo: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    sender: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    notes: {
      type: 'text',
      nullable: true,
    },
    attachments: {
      type: 'longtext',
      nullable: true,
    },
    createdAt: {
      type: 'datetime',
      createDate: true,
    },
  },
});
