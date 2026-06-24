const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'History',
  tableName: 'history',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    circleMailId: { type: 'int', nullable: true },
    action: { type: 'varchar', length: 100, nullable: false },
    fromCircle: { type: 'varchar', length: 255, nullable: true },
    toCircle: { type: 'varchar', length: 255, nullable: true },
    note: { type: 'text', nullable: true },
    actor: { type: 'varchar', length: 255, nullable: true },
    createdAt: { type: 'datetime', createDate: true },
  },
});
