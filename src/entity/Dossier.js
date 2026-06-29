const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Dossier',
  tableName: 'dossiers',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    title: { type: 'varchar', length: 255, nullable: true },
    projectName: { type: 'varchar', length: 255, nullable: true },
    subject: { type: 'varchar', length: 512, nullable: true },
    sourceEntity: { type: 'varchar', length: 50, nullable: true },
    sourceId: { type: 'int', nullable: true },
    circleName: { type: 'varchar', length: 255, nullable: true },
    payload: { type: 'text', nullable: true },
    attachments: { type: 'longtext', nullable: true },
    status: { type: 'varchar', length: 50, default: 'قيد العمل' },
    currentDepartmentId: { type: 'int', nullable: true },
    isLocked: { type: 'boolean', default: false },
    isTransferred: { type: 'boolean', default: false },
    deletedAt: { type: 'datetime', nullable: true },
    createdAt: { type: 'datetime', createDate: true },
    updatedAt: { type: 'datetime', updateDate: true },
  },
});
