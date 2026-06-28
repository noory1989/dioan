const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Reception',
  tableName: 'reception',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    name: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    category: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    qualification: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    request: {
      type: 'text',
      nullable: true,
    },
    subject: {
      type: 'text',
      nullable: true,
    },
    submissionDate: {
      type: 'date',
      nullable: true,
    },
    requestNo: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    address: {
      type: 'varchar',
      length: 500,
      nullable: true,
    },
    phone: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    nationalId: {
      type: 'varchar',
      length: 100,
      nullable: true,
    },
    result1: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    result2: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    result3: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    result4: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    notes: {
      type: 'text',
      nullable: true,
    },
    out1: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    in2: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    out2: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    in3: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    out3: {
      type: 'varchar',
      length: 255,
      nullable: true,
    },
    attachments: {
      type: 'longtext',
      nullable: true,
    },
    status: {
      type: 'varchar',
      length: 50,
      nullable: true,
      default: 'open',
    },
    isLocked: {
      type: 'boolean',
      default: false,
    },
    lockedAt: {
      type: 'datetime',
      nullable: true,
    },
    createdAt: {
      type: 'datetime',
      createDate: true,
    },
    deletedAt: {
      type: 'datetime',
      nullable: true,
    },
  },
});
