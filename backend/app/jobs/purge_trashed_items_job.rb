class PurgeTrashedItemsJob < ApplicationJob
  queue_as :default

  RETENTION_PERIOD = 30.days

  # Permanently removes documents that have sat in the trash longer than the
  # retention period. Folders are hard-deleted immediately, so only documents
  # accumulate here.
  def perform(cutoff: RETENTION_PERIOD.ago)
    Document.trashed.where(deleted_at: ..cutoff).find_each(&:destroy)
  end
end
