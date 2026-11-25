package team_analytics

import rego.v1

import data.utils

# Team Analytics (its figures and its settings) is read and changed by administrators only, with or
# without an organization selected. No organization role allows it, an owner's included.
#
# The one exception: the client settings (scope "view:client-settings"), which the interface of every
# signed-in user reads to know what an administrator set for it (whether shortcut hints are shown).
# They hold no figure and no name. Only signed-in users reach a policy at all.
#
# input: {
#     "scope": <"view"|"update"|"view:client-settings"> or null,
#     "auth": {
#         "user": {
#             "id": <num>,
#             "privilege": <"admin"|"user"|"worker"> or null
#         },
#         "organization": {
#             "id": <num>,
#             "owner": {
#                 "id": <num>
#             },
#             "user": {
#                 "role": <"owner"|"maintainer"|"supervisor"|"worker"> or null
#             }
#         } or null,
#     },
#     "resource": null,
# }

default allow := false

allow if {
    utils.is_admin
}

allow if {
    input.scope == "view:client-settings"
}
