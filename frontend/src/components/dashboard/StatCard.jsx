import React from "react";
import PropTypes from "prop-types";
import {
  Card,
  CardBody,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  HStack,
  Icon,
  Progress,
  useColorModeValue,
} from "@chakra-ui/react";

const StatCard = ({
  icon,
  iconColor,
  label,
  value,
  helpText,
  showProgress = false,
  progressValue = 0,
  progressColor = "blue",
}) => {
  return (
    <Card bg={useColorModeValue("white", "gray.800")} shadow="sm">
      <CardBody>
        <Stat>
          <HStack>
            <Icon as={icon} color={iconColor} boxSize={6} />
            <StatLabel>{label}</StatLabel>
          </HStack>
          <StatNumber>{value}</StatNumber>
          {helpText && <StatHelpText>{helpText}</StatHelpText>}
          {showProgress && (
            <Progress
              value={progressValue}
              colorScheme={progressColor}
              size="sm"
              mt={2}
            />
          )}
        </Stat>
      </CardBody>
    </Card>
  );
};

StatCard.propTypes = {
  icon: PropTypes.any.isRequired,
  iconColor: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  helpText: PropTypes.string,
  showProgress: PropTypes.bool,
  progressValue: PropTypes.number,
  progressColor: PropTypes.string,
};

export default StatCard;
