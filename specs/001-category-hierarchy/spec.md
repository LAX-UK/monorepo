# Feature Specification: Category Hierarchy Integrity

**Feature Branch**: `001-category-hierarchy`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "Category hierarchy integrity and validation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prevent Invalid Category Parents (Priority: P1)

As an admin or operator creating category data, I need category hierarchy validation so invalid relationships do not enter the database.

**Why this priority**: Invalid parent relationships can break category filtering and make lots/sales classification unreliable.

**Independent Test**: Attempt to create/update categories with valid and invalid `parent_id` values through repository/service entry points; only valid relationships are accepted.

**Acceptance Scenarios**:

1. **Given** an existing root category, **When** I create a child with that parent, **Then** the category is saved with the expected `parentId`.
2. **Given** a non-existent parent id, **When** I create or update a category, **Then** the operation is rejected with a validation/domain error.
3. **Given** a category id, **When** I try to assign the category as its own parent, **Then** the operation is rejected.

---

### User Story 2 - Serve Stable Category Trees (Priority: P2)

As a frontend consumer, I need predictable category hierarchy responses so forms and filters can render parent/child options safely.

**Why this priority**: UI flows for lots, sales, and submissions depend on trustworthy category structure.

**Independent Test**: Fetch categories from API and verify parent references only point to valid categories and never self-reference.

**Acceptance Scenarios**:

1. **Given** categories with parent relationships, **When** `GET /categories` is called, **Then** each returned `parentId` is either `null` or references an existing category id.
2. **Given** malformed category records from a legacy import, **When** categories are listed, **Then** invalid parent references are handled deterministically (either corrected to `null` or rejected upstream per chosen implementation policy).

---

### User Story 3 - Document Category Invariants (Priority: P3)

As a developer, I need hierarchy rules documented in specs/contracts so future changes do not reintroduce integrity gaps.

**Why this priority**: This closes the gap identified in system analysis and creates maintainable guardrails.

**Independent Test**: Review `docs/openapi.yaml`, relevant validators/types, and tests to confirm hierarchy assumptions are explicit.

**Acceptance Scenarios**:

1. **Given** updated contracts and docs, **When** a new engineer adds category-related features, **Then** they can identify allowed parent/child rules without inferring from implementation.

---

### Edge Cases

- Parent category deleted after children exist (expected behavior should be `parentId -> null` with current FK delete policy).
- Circular relationship attempts beyond direct self-parenting (A -> B -> A) during updates/imports.
- Bulk imports containing mixed valid/invalid parent references.
- Existing production data with historical invalid relationships.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce database-level referential integrity for `category.parent_id` referencing `category.id`.
- **FR-002**: System MUST reject self-parenting (`id == parent_id`) at application validation/service layer.
- **FR-003**: System MUST define and enforce behavior for circular parent chains (reject on write for this pilot scope).
- **FR-004**: System MUST preserve current delete semantics where removing a parent category sets child `parentId` to `null`.
- **FR-005**: API category listing MUST not return unresolved parent references.
- **FR-006**: Category invariants MUST be covered by tests in API and/or repository layers.
- **FR-007**: Category hierarchy behavior MUST be documented in project specs/contracts used by future features.

### Key Entities *(include if feature involves data)*

- **Category**: Taxonomy node with `id`, `name`, `slug`, and optional `parentId`.
- **Lot/Sale/ItemSubmission**: Domain objects that reference category ids and rely on valid category structure.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of write-path tests for category parent validation pass, including non-existent parent and self-parent cases.
- **SC-002**: Existing category consumers (`lots`, `sales`, `item submissions`) continue to pass current test suites with no regression from hierarchy enforcement.
- **SC-003**: No category rows can be inserted/updated with an unresolved parent id in the target environment after rollout.
- **SC-004**: Category hierarchy rules are explicitly captured in the feature spec, plan, tasks, and referenced contract/docs files.

## Assumptions

- Category creation/update paths either already exist or will be introduced in API/repository scope during implementation.
- Current schema already includes a foreign key and index; this feature hardens behavior and tests rather than redesigning taxonomy.
- No UI redesign is required; existing clients continue consuming `GET /categories` response shape.
- Migration strategy can include cleanup of legacy invalid rows before stricter checks are fully enforced.
