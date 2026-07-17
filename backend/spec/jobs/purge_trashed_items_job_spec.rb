require "rails_helper"

RSpec.describe PurgeTrashedItemsJob, type: :job do
  def trash!(record, at:)
    record.update_column(:deleted_at, at)
  end

  it "permanently deletes documents trashed longer than the retention period" do
    old = create(:document)
    trash!(old, at: 31.days.ago)

    described_class.perform_now

    expect(Document.exists?(old.id)).to be(false)
  end

  it "keeps documents trashed within the retention period" do
    recent = create(:document)
    trash!(recent, at: 29.days.ago)

    described_class.perform_now

    expect(Document.exists?(recent.id)).to be(true)
  end

  it "keeps documents that are not trashed" do
    active = create(:document)

    described_class.perform_now

    expect(Document.exists?(active.id)).to be(true)
  end

  it "honours an explicit cutoff" do
    document = create(:document)
    trash!(document, at: 10.days.ago)

    described_class.perform_now(cutoff: 5.days.ago)

    expect(Document.exists?(document.id)).to be(false)
  end
end
