from ConfigParser import SafeConfigParser

def getopt(section,option):
    parser = SafeConfigParser()
    parser.read('../mitro.cfg')
    return parser.get(section, option)
