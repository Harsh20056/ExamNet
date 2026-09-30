/**
 * Socket Event Emitters
 * 
 * Helper functions to emit socket events from services.
 * Prevents circular dependencies by re-exporting socket functions.
 */

const { 
  emitSheetAssigned,
  emitSheetUpdated,
  emitAnomalyAlert,
  emitModerationNeeded,
  emitIdentityCheckFailed
} = require('../sockets');

module.exports = {
  emitSheetAssigned,
  emitSheetUpdated,
  emitAnomalyAlert,
  emitModerationNeeded,
  emitIdentityCheckFailed
};
