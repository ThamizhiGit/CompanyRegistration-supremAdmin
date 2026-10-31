"""Dump the super-admin part of the con-backend GraphQL schema as SDL.

The super-admin API is served by the main schema (EmployeeManagement.schema)
at /graphql/. This keeps only the root fields the super-admin Query/Mutation
classes define (and every type they reach), so the fixture stays small but is
exactly what the served endpoint accepts.

Run from the con-backend checkout (needs the Django settings / database env):

    OUT=../supremAdmin/tests/fixtures/superadmin-schema.graphql \
      python manage.py shell < ../supremAdmin/scripts/dump_superadmin_schema.py

The supremAdmin tests validate every gql document, and every mocked request,
against that file.
"""
import os

from graphene.utils.str_converters import to_camel_case
from graphql import GraphQLObjectType, GraphQLSchema, print_schema

from EmployeeManagement.schema import schema as served_schema
from supreme_admin.schema import Mutation as SuperAdminMutation, Query as SuperAdminQuery

full = served_schema.graphql_schema


def pick(root_type, graphene_type):
    names = [to_camel_case(name) for name in graphene_type._meta.fields]
    missing = [name for name in names if name not in root_type.fields]
    if missing:
        raise SystemExit(f"{root_type.name} fields not served by /graphql/: {missing}")
    return GraphQLObjectType(root_type.name, fields={name: root_type.fields[name] for name in sorted(names)})


pruned = GraphQLSchema(
    query=pick(full.query_type, SuperAdminQuery),
    mutation=pick(full.mutation_type, SuperAdminMutation),
)
sdl = print_schema(pruned) + "\n"
out = os.environ.get("OUT")
if out:
    with open(out, "w", encoding="utf-8") as handle:
        handle.write(sdl)
    print(f"Wrote {out} ({len(sdl)} bytes)")
else:
    print(sdl)
