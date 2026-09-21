# ADR 0001: Permanent archive with read-only access

## Status

Accepted

## Context

External vendor accounts are not managed by this system. Form and operation-log data must remain available in the database after 180 days, rather than being deleted. Ordinary list views must not show this aged data, while authorized users need to investigate historical records.

The ordinary data-viewing permission alone is insufficient for archive access. Archived operation logs can expose sensitive audit details such as actors, IP addresses, and authorization changes.

## Decision

The system archives form data 180 days after its last successful submission and operation logs 180 days after their event time. A scheduled process runs daily at 00:00 Asia/Taipei and records the actual archive time.

Archived records remain in the database permanently, are hidden from ordinary lists, and are strictly read-only. They cannot be edited, deleted again, restored, or exported.

Access requires both the applicable existing view permission and one of two separate permissions: view archived form data or view archived operation logs. Authorized users can enable an off-by-default "include archived data" filter and must supply a date range for historical queries. Archived rows and details identify their archived state and archive time.

## Consequences

- Historical records remain available for authorized audit and investigation.
- Access to archived forms and archived operation logs follows least privilege and is independently assignable.
- Database storage, privacy exposure, and historical-query costs grow over time because there is no automatic deletion.
- Operations must monitor storage and query performance as retained data accumulates.
