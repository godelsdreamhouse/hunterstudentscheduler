"""Manage only this workflow's temporary /32 PostgreSQL ingress rules."""
import argparse
import ipaddress
import json
import os
import subprocess
import time
import urllib.request

PREFIX = 'hunter-scraper:'


def aws(operation, **parameters):
    result = subprocess.run(
        ['aws', 'ec2', operation, '--region', os.environ['AWS_REGION'],
         '--cli-input-json', json.dumps(parameters), '--output', 'json'],
        check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout or '{}')


def rules(group):
    return aws('describe-security-group-rules', Filters=[
        {'Name': 'group-id', 'Values': [group]}
    ])['SecurityGroupRules']


def managed(rule):
    return (not rule.get('IsEgress') and rule.get('IpProtocol') == 'tcp'
            and rule.get('FromPort') == 5432 and rule.get('ToPort') == 5432
            and rule.get('Description', '').startswith(PREFIX)
            and ipaddress.ip_network(rule.get('CidrIpv4', '0.0.0.0/0')).prefixlen == 32)


def close(group, description):
    for rule in rules(group):
        if managed(rule) and rule['Description'] == description:
            aws('revoke-security-group-ingress', GroupId=group,
                SecurityGroupRuleIds=[rule['SecurityGroupRuleId']])
            print('Removed temporary runner ingress.')


def open_rule(group, description):
    # A killed runner may miss cleanup. Remove only our rules older than 3 hours.
    for rule in rules(group):
        if managed(rule):
            try:
                created = int(rule['Description'].rsplit(':', 1)[1])
            except ValueError:
                continue
            if created < time.time() - 10800:
                aws('revoke-security-group-ingress', GroupId=group,
                    SecurityGroupRuleIds=[rule['SecurityGroupRuleId']])
    with urllib.request.urlopen('https://checkip.amazonaws.com', timeout=20) as response:
        address = ipaddress.ip_address(response.read().decode().strip())
    if address.version != 4 or not address.is_global:
        raise ValueError('Expected a public IPv4 runner address')
    aws('authorize-security-group-ingress', GroupId=group, IpPermissions=[{
        'IpProtocol': 'tcp', 'FromPort': 5432, 'ToPort': 5432,
        'IpRanges': [{'CidrIp': f'{address}/32', 'Description': description}],
    }])
    print('Allowed this runner IPv4 address on PostgreSQL port 5432.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['open', 'close'])
    args = parser.parse_args()
    description = os.environ['RUNNER_RULE_DESCRIPTION']
    if not description.startswith(PREFIX):
        raise ValueError('Unexpected rule description')
    (open_rule if args.action == 'open' else close)(
        os.environ['RDS_SECURITY_GROUP_ID'], description)
