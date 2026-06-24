const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Overdue',
  tableName: 'overdue_dossiers',
  columns: {
    id: { primary: true, type: 'int', generated: true },
    dossierId: { type: 'int', nullable: false },
    departmentId: { type: 'int', nullable: false },
    overdueSince: { type: 'datetime', nullable: false },
    status: { type: 'varchar', length: 50, default: 'pending' },
    createdAt: { type: 'datetime', createDate: true }
  }
});
