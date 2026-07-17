require 'rails_helper'

RSpec.describe DocumentVersion, type: :model do
  subject { build(:document_version) }

  it { is_expected.to belong_to(:document) }
  it { is_expected.to belong_to(:user).optional }
  it { is_expected.to have_one_attached(:file) }
  it { is_expected.to validate_presence_of(:version_number) }
  it { is_expected.to validate_uniqueness_of(:version_number).scoped_to(:document_id) }
end
