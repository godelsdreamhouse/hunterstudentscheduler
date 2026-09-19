import importlib.util
import io
import unittest
from unittest.mock import patch
from pathlib import Path

spec = importlib.util.spec_from_file_location('network', Path(__file__).with_name('runner-network.py'))
network = importlib.util.module_from_spec(spec)
spec.loader.exec_module(network)


def rule(description='hunter-scraper:1:1:1', cidr='8.8.8.8/32'):
    return dict(IsEgress=False, IpProtocol='tcp', FromPort=5432, ToPort=5432,
                Description=description, CidrIpv4=cidr, SecurityGroupRuleId='sgr-test')


class NetworkTests(unittest.TestCase):
    def test_cleanup_leaves_other_rules_alone(self):
        current = rule('hunter-scraper:2:1:100')
        foreign = rule('developer')
        previous = rule()
        broad = rule('hunter-scraper:2:1:100', '0.0.0.0/0')
        with patch.object(network, 'rules', return_value=[current, foreign, previous, broad]), patch.object(network, 'aws') as aws:
            network.close('sg-test', current['Description'])
            aws.assert_called_once_with('revoke-security-group-ingress', GroupId='sg-test', SecurityGroupRuleIds=['sgr-test'])

    def test_open_uses_only_public_ipv4_host(self):
        with patch.object(network, 'rules', return_value=[]), patch.object(network.urllib.request, 'urlopen', return_value=io.BytesIO(b'8.8.8.8\n')), patch.object(network, 'aws') as aws:
            network.open_rule('sg-test', 'hunter-scraper:2:1:100')
            p = aws.call_args.kwargs['IpPermissions'][0]
            self.assertEqual(p['IpRanges'][0]['CidrIp'], '8.8.8.8/32')
            self.assertEqual((p['FromPort'], p['ToPort']), (5432, 5432))

    def test_private_address_is_rejected(self):
        with patch.object(network, 'rules', return_value=[]), patch.object(network.urllib.request, 'urlopen', return_value=io.BytesIO(b'127.0.0.1')), patch.object(network, 'aws') as aws:
            with self.assertRaises(ValueError):
                network.open_rule('sg-test', 'hunter-scraper:2:1:100')
            aws.assert_not_called()

    def test_only_old_managed_rules_are_removed(self):
        with patch.object(network, 'rules', return_value=[rule(), rule('developer'), rule('hunter-scraper:3:1:19999')]), patch.object(network.time, 'time', return_value=20000), patch.object(network.urllib.request, 'urlopen', return_value=io.BytesIO(b'8.8.8.8')), patch.object(network, 'aws') as aws:
            network.open_rule('sg-test', 'hunter-scraper:2:1:20000')
            self.assertEqual(aws.call_count, 2)
            self.assertEqual(aws.call_args_list[0].args[0], 'revoke-security-group-ingress')


if __name__ == '__main__':
    unittest.main()
