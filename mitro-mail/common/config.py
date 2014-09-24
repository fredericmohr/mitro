from ConfigParser import SafeConfigParser

def getopt(section,option):
    parser = SafeConfigParser(allow_no_value=True)
    parser.read('../mitro.cfg')
    return parser.get(section, option)
