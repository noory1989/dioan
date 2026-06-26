const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'CircleMail',
  tableName: 'circle_mail',
  columns: {
    id: {
      primary: true,
      type: 'int',
      generated: true,
    },
    sourceEntity: { type: 'varchar', length: 50, nullable: true },
    sourceId: { type: 'int', nullable: true },
    circleName: { type: 'varchar', length: 255, nullable: false },
    payload: { type: 'text', nullable: true },
    attachments: { type: 'longtext', nullable: true },
    status: { type: 'varchar', length: 50, default: 'open' },
    alerted: { type: 'boolean', default: false },
    // Dossier timing and workflow fields
    currentDepartmentId: { type: 'int', nullable: true },
    expectedDurationDays: { type: 'int', nullable: true },
    expectedDurationMinutes: { type: 'int', nullable: true },
    durationStartedAt: { type: 'datetime', nullable: true },
    deadlineAt: { type: 'datetime', nullable: true },
    isLocked: { type: 'boolean', default: false },
    isTransferred: { type: 'boolean', default: false },
    deletedAt: { type: 'datetime', nullable: true },
    lockedAt: { type: 'datetime', nullable: true },
    isOverdue: { type: 'boolean', default: false },
    createdAt: { type: 'datetime', createDate: true },
    updatedAt: { type: 'datetime', updateDate: true },
  },
});
